import prisma from "@/lib/prisma";

export async function getDefaultUser() {
  let user = await prisma.user.findUnique({
    where: { username: "swify_user" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: "swify_user",
        password: "password123",
      },
    });
  }

  return user;
}
