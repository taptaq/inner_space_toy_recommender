import type { Request, Response } from "express";

type UsernameRegistrationService = {
  createUsernameUser: (
    username: string,
    password: string,
  ) => Promise<{ success: true }>;
};

export function createUsernameRegistrationHandler({
  service,
}: {
  service: UsernameRegistrationService;
}) {
  return async (req: Request, res: Response) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password.trim()) {
      res.status(400).json({
        error: "Username and password are required",
      });
      return;
    }

    const result = await service.createUsernameUser(username, password);
    res.status(201).json(result);
  };
}
