export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return { user: session };
});
