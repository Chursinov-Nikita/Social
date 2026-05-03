import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!email || !password || !name) {
    return Response.json({ error: "Заполните все поля" }, { status: 400 });
  }

  if (password.length < 6) {
    return Response.json(
      { error: "Пароль минимум 6 символов" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ error: "Email уже занят" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: { name, email, password: hashed },
  });

  return Response.json({ ok: true });
}
