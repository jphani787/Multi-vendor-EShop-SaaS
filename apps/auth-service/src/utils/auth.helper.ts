import crypto from "crypto";
import { ValidationError } from "../../../../packages/error-handler";
import redis from "../../../../packages/libs/redis";
import { sendEmail } from "./sendMail";
import { NextFunction } from "express";

export const validateRegistrationData = (
  data: any,
  userType: "user" | "seller"
) => {
  const { name, email, password, phone_number, country } = data;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (
    !name ||
    !email ||
    !password ||
    (userType === "seller" && (!phone_number || !country))
  ) {
    throw new ValidationError(`Missing required fields!`);
  }

  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format!");
  }
};

export const checkOtpRestriction = async (
  email: string,
  next: NextFunction
) => {
  if (await redis.get(`otp_lock:${email}`)) {
    return next(
      new ValidationError(
        "Account locked due to multiple failed attempts! Try again after 30 minutes"
      )
    );
  }

  if (await redis.get(`otp_spam_lock:${email}`)) {
    return next(
      new ValidationError(
        "Too many OTP requests! Please wait 1hour before requesting again."
      )
    );
  }

  if (await redis.get(`otp_cooldown:${email}`)) {
    return next(
      new ValidationError("Please wait 1minute before requwsting a new OTP!")
    );
  }
};

export const trackOtpRequests = async (email: string, next: NextFunction) => {
  const otpRequestKey = `otp_request_count:${email}`;
  let otpRequests = parseInt((await redis.get(otpRequestKey)) || "0");
  if (otpRequests > 2) {
    await redis.set(`otp_span_lock:${email}`, "locked", "EX", 3600);
    return next(
      new ValidationError(
        "Too many OTP requests. Please try again 1 hour before requesting again. "
      )
    );
  }
  await redis.set(otpRequestKey, otpRequests + 1, "EX", 3600);
};

export const sendOtp = async (
  name: string,
  email: string,
  template: string
) => {
  const otp = crypto.randomInt(1000, 9999).toString();
  await sendEmail(email, "Verify Your Email", template, { name, otp });
  await redis.set(`otp:${email}`, otp, "EX", 300);
  await redis.set(`otp_cooldown:${email}`, "true", "EX", 60);
};

export const verifyOtp = async (
  email: string,
  otp: number,
  next: NextFunction
) => {
  const storedOtp = await redis.get(`otp:${email}`);
  console.log("storedOtp - ", storedOtp);
  if (!storedOtp) {
    return next(new ValidationError("Invalid or expried otp!"));
  }
  const failedAttemptsKey = `otp_attempts:${email}`;
  const failedAttempts = parseInt((await redis.get(failedAttemptsKey)) || "0");
  if (parseInt(storedOtp) !== otp) {
    if (failedAttempts > 2) {
      await redis.set(`otp_lock:${email}`, "locked", "EX", 1800);
      await redis.del(`otp:${email}`, failedAttemptsKey);
      return next(
        new ValidationError(
          "To many failed attempts, Your account is locked for 30 min"
        )
      );
    }

    await redis.set(failedAttemptsKey, failedAttempts + 1, "EX", 300);
    return next(
      new ValidationError(`Incorrect otp. ${2 - failedAttempts} attempts left.`)
    );
  }

  await redis.del(`otp:${email}`, failedAttemptsKey);
};
