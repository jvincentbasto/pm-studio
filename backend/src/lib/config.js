import dotenv from "dotenv";
import { utils } from "./utils.js";

//
const { envFile } = utils.getEnvFilename();
dotenv.config({ path: envFile, override: true });

const processEnv = process.env;
const envs = {
  port: processEnv.PORT,
  localMongoUri: processEnv.LOCAL_MONGO_URI,
  mongoUri: processEnv.MONGO_URI ?? processEnv.LOCAL_MONGO_URI,

  jwtSecret: processEnv.JWT_SECRET_KEY,
  nodeEnv: processEnv.NODE_ENV ?? "development",
  appUrl: processEnv.APP_URL ?? "http://localhost:3000",
  emailHost: processEnv.EMAIL_HOST,
  emailPort: Number(processEnv.EMAIL_PORT ?? 587),
  emailUser: processEnv.EMAIL_USER,
  emailPassword: processEnv.EMAIL_PASSWORD,
  emailFrom: processEnv.EMAIL_FROM,
};

const constants = {
  jwt: "jwt",
};

export const config = {
  envs,
  constants,
};
