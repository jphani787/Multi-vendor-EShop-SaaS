import { Request, Response, NextFunction } from "express";
import {
  validateRegistrationData,
  checkOtpRestriction,
  trackOtpRequests,
  sendOtp,
  verifyOtp,
} from "../utils/auth.helper";
import prisma from "../libs/prisma";
import bycrpt from "bcryptjs";
import { ValidationError } from "../../../../packages/error-handler";

export const userRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    validateRegistrationData(req.body, "user");
    const { name, email } = req.body;

    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) {
      return next(new ValidationError("User already exists with this email!"));
    }

    await checkOtpRestriction(email, next);
    await trackOtpRequests(email, next);
    await sendOtp(name, email, "user-activation-mail");

    res.status(200).json({
      message: "OTP sent to email. Please verify your account.",
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, otp, password, name } = req.body;
  try {
    if (!email || !otp || !password || !name) {
      return next(new ValidationError("All fileds are required!"));
    }

    const existUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existUser) {
      return next(new ValidationError("User already exist with this email."));
    }

    await verifyOtp(email, otp, next);
    const hasedPassword = await bycrpt.hash(password, 10);
    const user = await prisma.users.create({
      data: { name, email, password: hasedPassword },
    });
    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
      user,
    });
  } catch (error) {
    return next(error);
  }
};
