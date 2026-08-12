package workerdefinition

func cloneDefinition(definition Definition) Definition {
	definition.DefinitionSource = append([]byte{}, definition.DefinitionSource...)
	definition.Modes = append([]string{}, definition.Modes...)
	definition.ModelRequirement.ProtocolAdapters = append(
		[]string{},
		definition.ModelRequirement.ProtocolAdapters...,
	)
	definition.ToolModelRequirements = append(
		[]ToolModelRequirement{},
		definition.ToolModelRequirements...,
	)
	for index := range definition.ToolModelRequirements {
		requirement := &definition.ToolModelRequirements[index]
		requirement.ProviderKeys = append([]string{}, requirement.ProviderKeys...)
		requirement.ProtocolAdapters = append([]string{}, requirement.ProtocolAdapters...)
	}
	definition.CredentialBindings = append(
		[]CredentialBinding{},
		definition.CredentialBindings...,
	)
	definition.CredentialRequirementGroups = cloneCredentialRequirementGroups(
		definition.CredentialRequirementGroups,
	)
	definition.ConfigDocuments = append([]ConfigDocument{}, definition.ConfigDocuments...)
	definition.Image.VersionProbe = append([]string{}, definition.Image.VersionProbe...)
	return definition
}
