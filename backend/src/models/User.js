import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      maxlength: 80,
    },
    middleName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: false,
      minlength: 8,
      maxlength: 128,
      select: false,
    },
    authProviders: [
      {
        provider: {
          type: String,
          required: true,
        },
        providerId: {
          type: String,
          required: true,
        },
        avatarUrl: String,
        emailVerified: {
          type: Boolean,
          default: false,
        },
        connectedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationTokenHash: String,
    emailVerificationExpiresAt: Date,
    passwordResetTokenHash: String,
    passwordResetExpiresAt: Date,
    tokenVersion: {
      type: Number,
      default: 0,
    },
    accountType: {
      type: String,
      enum: ["regular", "guest", "expired"],
      default: "regular",
    },
    guestTokenHash: {
      type: String,
      select: false,
    },
    guestTokenExpiresAt: {
      type: Date,
      select: false,
    },
    guestExpiresAt: Date,
  },
  { timestamps: true },
);

userSchema.index(
  { "authProviders.provider": 1, "authProviders.providerId": 1 },
  { unique: true, partialFilterExpression: { "authProviders.0": { $exists: true } } },
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }

  const isPasswordCorrect = await bcrypt.compare(
    enteredPassword,
    this.password,
  );
  return isPasswordCorrect;
};

const User = mongoose.model("User", userSchema);
export default User;
