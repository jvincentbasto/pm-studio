import jwt from "jsonwebtoken";
import User from "../models/User.js";

import { config } from "../lib/config.js";

const { envs, constants } = config;

// main
const signup = async (req, res) => {
  try {

  } catch(error) {
    
  }

};
const login = async (req, res) => {
  try {

  } catch(error) {

  }
};
const logout = async (req, res) => {
  try {

  } catch(error) {
    
  }

};
const refreshTokenHandler = async (req, res) => {
  try {

  } catch(error) {
    
  }

};



// 
const requestEmailVerification = async (req, res) => {
  try {

  } catch(error) {
    
  }

};
const verifyEmail = async (req, res) => {
  try {

  } catch(error) {
    
  }

};



// 
const forgotPassword = async (req, res) => {
  try {

  } catch(error) {
    
  }

};
const resetPassword = async (req, res) => {
  try {

  } catch(error) {
    
  }

};



export const authController = {
  signup,
  login,
  logout,
  refreshTokenHandler,
  //
  requestEmailVerification,
  verifyEmail,
  //
  forgotPassword,
  resetPassword,
};
