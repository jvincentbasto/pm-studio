const getEnvFilename = () => {
  const nodeEnv = (process.env.NODE_ENV || "").trim();
  const isProduction = nodeEnv === "production";
  const envFile = isProduction ? ".env" : ".env.local";

  return { envFile, isProduction };
};

export const utils = { getEnvFilename };
