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
};

const constants = {
  jwt: "jwt",
};

export const config = {
  envs,
  constants,
};
