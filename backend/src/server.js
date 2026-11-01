import dotenv from "dotenv";
import { utils } from "./lib/utils.js";
import { connectDB } from "./lib/db.js";
import app from "./app.js";

//
const { isProduction, envFile } = utils.getEnvFilename();

//
dotenv.config({ path: envFile, override: true });
const PORT = process.env.PORT;

// production setup
// if (isProduction) {
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));

//   app.get(/.*/, (req, res) => {
//     res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
//   });
// }

app.listen(PORT, () => {
  // console.log("Environment", isProduction);
  console.log(`Server running on http://localhost:${PORT}`);
  connectDB();
});
