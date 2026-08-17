import crypto from "crypto";
import { cookies } from "next/headers";
import User from "@/models/User";

const SESSION_COOKIE = "warehouse_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  role: "ADMIN" | "STAFF";
  expiresAt: number;
};

type PopulatedWarehouse = {
  _id: { toString(): string };
  name: string;
  code: string;
};

type SafeUserInput = {
  _id: { toString(): string };
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  warehouseId?: unknown;
};

function getSessionSecret() {
  return process.env.AUTH_SECRET || "warehouse-demo-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export async function hashPassword(password: string) {
  return new Promise<string>((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}


export async function verifyPassword(
  password: string,
  hashedPassword: string
) {
  const [salt, storedHash] = hashedPassword.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  return new Promise<boolean>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      const derivedHash = Buffer.from(derivedKey.toString("hex"), "hex");
      const expectedHash = Buffer.from(storedHash, "hex");

      if (derivedHash.length !== expectedHash.length) {
        resolve(false);
        return;
      }

      resolve(crypto.timingSafeEqual(derivedHash, expectedHash));
    });
  });
}

export function createSessionToken(userId: string, role: "ADMIN" | "STAFF") {
  const payload: SessionPayload = {
    userId,
    role,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function parseSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const providedSignature = Buffer.from(signature);
  const actualSignature = Buffer.from(expectedSignature);

  if (providedSignature.length !== actualSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(providedSignature, actualSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      fromBase64Url(encodedPayload)
    ) as SessionPayload;

    if (payload.expiresAt < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(
  userId: string,
  role: "ADMIN" | "STAFF"
) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(userId, role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = parseSessionToken(token);

  if (!session) {
    return null;
  }

  const user = await User.findById(session.userId)
    .select("-passwordHash")
    .populate("warehouseId", "name code");

  if (!user || user.status !== "ACTIVE") {
    return null;
  }

  return user;
}

export async function requireSessionUser() {
  const user = await getSessionUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

function isPopulatedWarehouse(value: unknown): value is PopulatedWarehouse {
  return Boolean(
    value &&
      typeof value === "object" &&
      "_id" in value &&
      "name" in value &&
      "code" in value
  );
}

export function getUserWarehouseId(user: SafeUserInput) {
  if (
    user.warehouseId &&
    typeof user.warehouseId === "object" &&
    "_id" in user.warehouseId
  ) {
    return user.warehouseId._id;
  }

  return user.warehouseId ?? null;
}

export function getUserWarehouse(user: SafeUserInput) {
  if (!isPopulatedWarehouse(user.warehouseId)) {
    return null;
  }

  return user.warehouseId;
}

export function toSafeUser(user: SafeUserInput) {
  const warehouse = getUserWarehouse(user);

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    warehouse: warehouse
      ? {
          id: warehouse._id.toString(),
          name: warehouse.name,
          code: warehouse.code,
        }
      : null,
  };
}
