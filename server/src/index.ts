import app from "./app";

if (!process.env.BETTER_AUTH_SECRET) {
  console.error("FATAL: BETTER_AUTH_SECRET is not set. Refusing to start.");
  process.exit(1);
}

if (process.env.BETTER_AUTH_SECRET.length < 32) {
  console.error("FATAL: BETTER_AUTH_SECRET must be at least 32 characters.");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
