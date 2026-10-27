import mongoose from "mongoose";
import { config } from "./config.js";

const { mongoUri } = config.envs;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`Successfully connected to DB`);
  } catch (error) {
    console.log("Failed to connect to DB", error);
    process.exit(1); // 1 means failure
  }
};
