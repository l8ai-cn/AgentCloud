#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "json"
require "net/http"
require "set"
require "uri"

subject_id = Integer(ARGV.fetch(0))
output_path = File.expand_path(ARGV.fetch(1))
asset_dir = File.expand_path(ARGV.fetch(2))
asset_origin = ENV.fetch("EDUCODER_ASSET_ORIGIN", "http://websvc:8080")
asset_host = ENV.fetch("EDUCODER_ASSET_HOST", "oilan.ai")
allowed_redirect_hosts = Set.new(
  [
    URI.parse(asset_origin).host,
    asset_host,
    *ENV.fetch("EDUCODER_ASSET_REDIRECT_HOSTS", "").split(",")
  ].map(&:to_s).map(&:strip).reject(&:empty?)
)

FileUtils.mkdir_p(File.dirname(output_path))
FileUtils.mkdir_p(asset_dir)

def attributes_for(record, fields)
  fields.each_with_object({}) do |field, attributes|
    attributes[field.to_s] = record.public_send(field)
  end
end

def extension_for(content_type, path)
  by_type = {
    "image/jpeg" => ".jpg",
    "image/png" => ".png",
    "image/gif" => ".gif",
    "image/webp" => ".webp",
    "video/mp4" => ".mp4",
    "text/plain" => ".txt",
    "application/pdf" => ".pdf",
    "application/zip" => ".zip"
  }[content_type.to_s.downcase]
  return by_type if by_type

  extension = File.extname(URI.parse(path).path)
  extension.empty? ? ".bin" : extension.downcase
rescue URI::InvalidURIError
  ".bin"
end

class AssetMissing < StandardError; end

def get_asset(origin, host, path, allowed_redirect_hosts, limit = 5, current_uri = nil)
  raise "too many redirects for #{path}" if limit.zero?

  origin_uri = URI.parse(origin)
  request_uri = current_uri || URI.join("#{origin_uri}/", path.sub(%r{\A/}, ""))
  unless %w[http https].include?(request_uri.scheme) && allowed_redirect_hosts.include?(request_uri.host)
    raise "asset redirect target is not allowed: #{request_uri}"
  end
  request = Net::HTTP::Get.new(request_uri)
  request["Host"] = host if request_uri.host == origin_uri.host
  response = Net::HTTP.start(
    request_uri.host,
    request_uri.port,
    use_ssl: request_uri.scheme == "https"
  ) { |http| http.request(request) }

  if response.is_a?(Net::HTTPRedirection)
    location = response["location"]
    raise "redirect without location for #{path}" if location.to_s.empty?

    next_uri = URI.join(request_uri.to_s, location)
    return get_asset(origin, host, path, allowed_redirect_hosts, limit - 1, next_uri)
  end
  raise AssetMissing, "asset is missing: HTTP #{response.code} #{path}" if %w[404 410].include?(response.code)
  raise "asset request failed: HTTP #{response.code} #{path}" unless response.is_a?(Net::HTTPSuccess)

  [response.body, response["content-type"].to_s.split(";").first]
end

subject = Subject.find(subject_id)
subject_fields = %i[
  id identifier name description learning_notes learning_notes_title status
  stages_count shixuns_count stage_shixuns_count publish_time
]
stage_fields = %i[id position name description]
shixun_fields = %i[
  id name identifier repo_name git_url status language challenges_count is_jupyter
  is_jupyter_lab virtual_machine vnc webssh linux_vnc windows_vnc evaluate_method
]
challenge_fields = %i[
  id position subject answer score difficulty evaluation_way st task_pass path exec_path
  exec_time unity_3d unity_3d_routes unity_3d_data web_route picture_path
  expect_picture_path show_type test_set_rules test_set_rules_expression
]
test_set_fields = %i[
  id position input output score is_public is_invisible match_rule last_match_rule
  is_file in_object_key out_object_key is_target target_name tags
]
answer_fields = %i[id name contents score level]
choice_fields = %i[
  id position subject question_type standard_answer answer score category difficult
  blank_standard_answer is_order
]
choice_question_fields = %i[id position option_name right_key]
attachment_fields = %i[
  id container_id container_type filename disk_filename disk_directory filesize content_type
  attachtype description is_public is_publish cloud_url link
]
environment_fields = %i[
  id name position resource_type program_language is_support_code_editor is_support_vscode
  is_support_vnc is_support_webssh is_support_jupyter_lab start_command envs privileged
  add_cap drop_cap network_mode
]
service_config_fields = %i[
  id cpu_limit memory_limit request_limit lower_cpu_limit resource_limit
  mirror_repository_id shixun_environment_id gpu_size gpu_limit gpu_memory_limit
]

stages = subject.stages.order(:position, :id).map do |stage|
  shixuns = StageShixun
    .where(stage_id: stage.id, item_type: [nil, "Shixun"])
    .where.not(shixun_id: nil)
    .order(:position, :id)
    .map do |stage_shixun|
      shixun = Shixun.find(stage_shixun.shixun_id)
      shixun_info = ShixunInfo.find_by(shixun_id: shixun.id)
      challenges = shixun.challenges.order(:position, :id).map do |challenge|
        choices = challenge.challenge_chooses.order(:position, :id).map do |choice|
          attributes_for(choice, choice_fields).merge(
            "options" => choice.challenge_questions.order(:position, :id).map do |option|
              attributes_for(option, choice_question_fields)
            end
          )
        end
        attributes_for(challenge, challenge_fields).merge(
          "test_sets" => challenge.test_sets.order(:position, :id).map do |test_set|
            attributes_for(test_set, test_set_fields)
          end,
          "answers" => challenge.challenge_answers.order(:level, :id).map do |answer|
            attributes_for(answer, answer_fields)
          end,
          "choices" => choices
        )
      end

      attributes_for(shixun, shixun_fields).merge(
        "position" => stage_shixun.position,
        "description" => shixun_info&.description,
        "propaedeutics" => shixun_info&.propaedeutics,
        "evaluate_script" => shixun_info&.evaluate_script,
        "challenges" => challenges,
        "attachments" => Attachment.where(container_type: "Shixun", container_id: shixun.id).order(:id).map do |attachment|
          attributes_for(attachment, attachment_fields)
        end,
        "environments" => ShixunEnvironment.where(shixun_id: shixun.id).order(:position, :id).map do |environment|
          attributes_for(environment, environment_fields)
        end,
        "service_configs" => ShixunServiceConfig.where(shixun_id: shixun.id).order(:id).map do |config|
          attributes_for(config, service_config_fields)
        end
      )
    end

  attributes_for(stage, stage_fields).merge("shixuns" => shixuns)
end

subject_attachments = subject.attachments.order(:id).map do |attachment|
  exported_name = "subject-attachment-#{attachment.id}#{extension_for(attachment.content_type, attachment.filename)}"
  source_path = attachment.diskfile
  raise "subject attachment file does not exist: #{source_path}" unless File.file?(source_path)

  FileUtils.cp(source_path, File.join(asset_dir, exported_name))
  attributes_for(attachment, attachment_fields).merge(
    "saved_file_path" => attachment.saved_file_path,
    "exported_file_name" => exported_name
  )
end

payload = {
  "subject" => attributes_for(subject, subject_fields),
  "stages" => stages,
  "subject_attachments" => subject_attachments
}

attachment_urls = []
walker = lambda do |value|
  case value
  when Hash
    value.each_value { |item| walker.call(item) }
  when Array
    value.each { |item| walker.call(item) }
  when String
    value.scan(%r{/api/attachments/[A-Za-z0-9+/=_-]+(?:\?[^"'\s<>)]+)?}) do |match|
      attachment_urls << match unless attachment_urls.include?(match)
    end
  end
end
walker.call(payload)

attachment_map = {}
missing_attachment_urls = []
attachment_urls.each_with_index do |url, index|
  begin
    body, content_type = get_asset(asset_origin, asset_host, url, allowed_redirect_hosts)
    if content_type == "application/json"
      response = JSON.parse(body)
      raise response["message"].to_s if response.is_a?(Hash) && response["status"].to_i != 0
    end
    filename = format("attachment-%03d%s", index + 1, extension_for(content_type, url))
    File.binwrite(File.join(asset_dir, filename), body)
    attachment_map[url] = "assets/attachments/#{filename}"
  rescue AssetMissing => error
    missing_attachment_urls << {"url" => url, "error" => error.message}
  end
end

payload["attachment_map"] = attachment_map
payload["missing_attachment_urls"] = missing_attachment_urls
payload["export"] = {
  "source_platform" => "oilan1.0",
  "subject_id" => subject_id,
  "attachment_count" => attachment_map.length,
  "subject_attachment_count" => subject_attachments.length
}

File.write(output_path, JSON.pretty_generate(payload) + "\n")
puts JSON.generate(
  "output" => output_path,
  "asset_dir" => asset_dir,
  "stages" => stages.length,
  "shixuns" => stages.sum { |stage| stage["shixuns"].length },
  "challenges" => stages.sum { |stage| stage["shixuns"].sum { |shixun| shixun["challenges"].length } },
  "attachments" => attachment_map.length,
  "missing_attachments" => missing_attachment_urls.length
)
