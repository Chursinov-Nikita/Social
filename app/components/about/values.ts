import { t } from "@/app/translation/translation";

export const getFeatures = (tr: typeof t.en) => [
  {
    icon: "💬",
    title: tr.featureChat,
    description: tr.featureChatDesc,
  },
  {
    icon: "📸",
    title: tr.featurePhoto,
    description: tr.featurePhotoDesc,
  },
  {
    icon: "🔒",
    title: tr.featurePrivacy,
    description: tr.featurePrivacyDesc,
  },
];

export const getValues = (tr: typeof t.en) => [
  {
    icon: "🤝",
    title: tr.valueRespect,
    description: tr.valueRespectDesc,
  },
  {
    icon: "💡",
    title: tr.valueInnovation,
    description: tr.valueInnovationDesc,
  },
  {
    icon: "🌍",
    title: tr.valueInclusivity,
    description: tr.valueInclusivityDesc,
  },
  {
    icon: "⚡",
    title: tr.valueSimplicity,
    description: tr.valueSimplicityDesc,
  },
];
