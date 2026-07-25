package operatorcatalog

func skillDefinitions() []SkillDefinition {
	videoUse := ResearchSource{
		URL:     "https://github.com/browser-use/video-use",
		Commit:  "92c2b34e44c205cbc2acae7f6ca7c1c219d5dd66",
		License: "MIT",
	}
	return []SkillDefinition{
		{
			Slug: "seedance-expert", Name: "Seedance 视频生成",
			Description: "使用已绑定的 Seedance 视频模型生成 MP4，并输出为平台可预览的 Worker 成果。",
			License:     "Apache-2.0", Tags: []string{"video", "seedance", "generation"},
		},
		{
			Slug: "short-video-directing", Name: "短视频编导",
			Description: "从传播目标产出脚本、镜头表、连续性说明和剪辑简报。",
			License:     "Apache-2.0", Tags: []string{"video", "short-video", "directing"},
		},
		{
			Slug: "video-editing-workflow", Name: "视频剪辑工作流",
			Description: "基于 EDL、FFmpeg、字幕与音频规则完成可回溯剪辑。",
			License:     "Apache-2.0", Tags: []string{"video", "editing", "ffmpeg"},
			ResearchSources: []ResearchSource{videoUse},
		},
		{
			Slug: "remotion-video-production", Name: "Remotion 视频制作",
			Description: "用 React 与 Remotion 构建确定性视频合成并完成渲染。",
			License:     "Apache-2.0", Tags: []string{"video", "production", "remotion"},
		},
		{
			Slug: "video-motion-graphics", Name: "视频动效设计",
			Description: "为字幕、信息卡、产品演示和叙事节点设计可读动效。",
			License:     "Apache-2.0", Tags: []string{"video", "motion", "graphics"},
		},
		{
			Slug: "video-delivery-qa", Name: "视频交付质检",
			Description: "用媒体探测、抽帧、听检和字幕检查验证最终成片。",
			License:     "Apache-2.0", Tags: []string{"video", "qa", "delivery"},
		},
		{
			Slug: "media-rights-research", Name: "媒体素材版权调研",
			Description: "检索可用素材并保存来源、许可、署名与使用边界。",
			License:     "Apache-2.0", Tags: []string{"video", "research", "rights"},
		},
		{
			Slug: "pattern-generate", Name: "花型元素生成",
			Description: "根据参考图、元素和风格约束生成可追溯的花型设计素材。",
			License:     "Proprietary", Tags: []string{"pattern", "generation", "textile"},
		},
		{
			Slug: "canvas-compose", Name: "花型画布铺排",
			Description: "将花型元素按重复方式铺排成可接版的大画布。",
			License:     "Proprietary", Tags: []string{"pattern", "layout", "canvas"},
		},
		{
			Slug: "pattern-seam-review", Name: "花型接版评审",
			Description: "用偏移、平铺和边缘证据检查重复单元是否无缝。",
			License:     "Proprietary", Tags: []string{"pattern", "qa", "seamless"},
		},
		{
			Slug: "lovart-api", Name: "Lovart 图像生成",
			Description: "调用 Lovart 图像能力生成或重绘花型相关视觉资产。",
			License:     "Proprietary", Tags: []string{"pattern", "image", "lovart"},
		},
		{
			Slug: "course-researcher", Name: "课程研究",
			Description: "围绕课程目标梳理参考资料、知识点、受众和教学风险。",
			License:     "Proprietary", Tags: []string{"course", "research", "education"},
		},
		{
			Slug: "course-architect", Name: "课程架构",
			Description: "设计课程主线、章节结构、任务路径和验收标准。",
			License:     "Proprietary", Tags: []string{"course", "architecture", "education"},
		},
		{
			Slug: "course-builder", Name: "课程内容构建",
			Description: "把课程结构转成课件正文、学习材料和教学任务。",
			License:     "Proprietary", Tags: []string{"course", "content", "materials"},
		},
		{
			Slug: "course-lab-builder", Name: "课程实验构建",
			Description: "设计可执行实验、实操步骤、检查点和提交物。",
			License:     "Proprietary", Tags: []string{"course", "lab", "practice"},
		},
		{
			Slug: "course-practice-builder", Name: "课程练习评价",
			Description: "生成随堂练习、题库、评分规则和学习反馈。",
			License:     "Proprietary", Tags: []string{"course", "assessment", "practice"},
		},
		{
			Slug: "course-ppt", Name: "课程课件设计",
			Description: "把课程内容转成结构清晰、可讲授的演示课件方案。",
			License:     "Proprietary", Tags: []string{"course", "slides", "presentation"},
		},
	}
}
