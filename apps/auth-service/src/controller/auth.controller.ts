import { Request, Response, NextFunction } from "express";
import {
  validateRegistrationData,
  checkOtpRestriction,
} from "../utils/auth.helper";
import prisma from "../libs/prisma";
import { ValidationError } from "../../../../packages/error-handler";

export const userRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  validateRegistrationData(req.body, "user");
  const { name, email } = req.body;

  const existingUser = await prisma.users.findUnique({ where: email });
  if (existingUser) {
    return next(new ValidationError("User already exists with this email!"));
  }

  await checkOtpRestriction(email, next);
};
