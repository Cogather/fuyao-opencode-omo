/**
 * Mock data for skill market. Replace with real API in adapter when backend is ready.
 */

import type { SkillMarketItem } from "./types"

export const MOCK_SKILL_MARKET_ITEMS: SkillMarketItem[] = [
  {
    id: "market-code-review",
    name: "code-review",
    version: "1.0.0",
    description: "Code review skill from market (Mock).",
    platform: "fuyao",
  },
  {
    id: "market-doc-helper",
    name: "doc-helper",
    version: "1.0.0",
    description: "Documentation helper skill from market (Mock).",
    platform: "fuyao",
  },
  {
    id: "market-test-gen",
    name: "test-gen",
    version: "1.0.0",
    description: "Test generation skill from market (Mock).",
    platform: "agentcenter",
  },
]
