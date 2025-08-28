import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hash(plain: string): Promise<string> {
  return await bcrypt.hash(plain, ROUNDS);
}

export async function verify(plain: string, hashed: string): Promise<boolean> {
  return await bcrypt.compare(plain, hashed);
}