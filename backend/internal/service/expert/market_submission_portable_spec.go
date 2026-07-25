package expert

import specdomain "github.com/l8ai-cn/agentcloud/backend/internal/domain/workerspec"

func portableSubmissionSpec(source specdomain.Spec) (specdomain.Spec, error) {
	portable, err := specdomain.NormalizeAndValidate(source)
	if err != nil {
		return specdomain.Spec{}, err
	}
	portable.TypeConfig.SecretRefs = map[string]specdomain.SecretReference{}
	if err := validatePortableMarketSpec(portable); err != nil {
		return specdomain.Spec{}, err
	}
	return portable, nil
}
