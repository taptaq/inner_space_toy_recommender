import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createUsernameRegistrationHandler } from "./user-register-route.ts";

function createMockRequest(body: unknown) {
  return { body } as Request;
}

function createMockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      return response;
    },
  } as unknown as Response;

  return {
    response,
    readStatusCode: () => statusCode,
    readJsonPayload: () => jsonPayload,
  };
}

test("username registration handler creates a confirmed hidden-email user", async () => {
  let captured: unknown;
  const handler = createUsernameRegistrationHandler({
    service: {
      createUsernameUser: async (username, password) => {
        captured = { username, password };
        return { success: true };
      },
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ username: "taptaq", password: "secret-pass" }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 201);
  assert.deepEqual(mockResponse.readJsonPayload(), { success: true });
  assert.deepEqual(captured, { username: "taptaq", password: "secret-pass" });
});

test("username registration handler rejects missing credentials", async () => {
  const handler = createUsernameRegistrationHandler({
    service: {
      createUsernameUser: async () => ({ success: true }),
    },
  });

  const mockResponse = createMockResponse();
  await handler(
    createMockRequest({ username: "", password: "" }),
    mockResponse.response,
  );

  assert.equal(mockResponse.readStatusCode(), 400);
  assert.deepEqual(mockResponse.readJsonPayload(), {
    error: "Username and password are required",
  });
});
