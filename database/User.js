import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    picture: {type: String},
    name: {type: String, require: true, unique: true},
    email: {type: String, require: true, unique: true},
    identification: {type: String, require: true, unique: true},
    password: {type: String, require: true},
    login: {type: Boolean, default: false},
    like: {type: Array, unique: true},
    hate: {type: Array, unique: true},
})

export const User = mongoose.model("user", userSchema);