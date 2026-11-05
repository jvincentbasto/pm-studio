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
  backendUrl: processEnv.BACKEND_URL ?? "http://localhost:8000",
  auth0IssuerBaseUrl: processEnv.AUTH0_ISSUER_BASE_URL,
  auth0ClientId: processEnv.AUTH0_CLIENT_ID,
  auth0ClientSecret: processEnv.AUTH0_CLIENT_SECRET,
  auth0SessionSecret: processEnv.AUTH0_SESSION_SECRET,
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
