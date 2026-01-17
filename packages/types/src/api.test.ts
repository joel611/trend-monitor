import { describe, expect, test } from "bun:test";
import {
  CreateKeywordRequest,
  UpdateKeywordRequest,
  KeywordResponse,
  ListKeywordsResponse,
} from "./api";

describe("API DTOs", () => {
  test("CreateKeywordRequest has required fields", () => {
    const req: CreateKeywordRequest = {
      name: "test",
      aliases: [],
      tags: [],
    };
    expect(req.name).toBe("test");
  });

  test("UpdateKeywordRequest has optional fields", () => {
    const req: UpdateKeywordRequest = {
      name: "updated",
    };
    expect(req.aliases).toBeUndefined();
  });
});
