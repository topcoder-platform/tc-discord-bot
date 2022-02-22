import { verify } from 'crypto';
import { Schema } from 'mongoose';

// 1. Create an interface representing a document in MongoDB.
export interface DiscordUser {
    discordID: string;
    nickname: string;
    username: string;
    tcHandle: string; // verified proof
    checkHandle: string;
    checkValid: boolean,
    verifyDate: Date
}

// 2. Create a Schema corresponding to the document interface.
export const MemberSchema = new Schema<DiscordUser>({
    discordID: { type: String, required: true, unique: true },
    nickname: { type: String },
    username: { type: String, required: true },
    tcHandle: { type: String, unique: true, sparse: true }, // verified proof
    checkHandle: { type: String },
    checkValid: { type: Boolean },
    verifyDate: { type: Date }
});
