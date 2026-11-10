import { HttpError } from "http-errors";

export const errorHandler = (err, req, res, next) => {
  console.error("Error Middleware:", err);

  if (err instanceof HttpError && err.expose) {
    return res.status(err.status).json({
      message: err.message || err.name,
    });
  }

  const isDev = process.env.NODE_ENV === "development";

  res.status(err.status && err.status < 500 ? err.status : 500).json({
    message: isDev
      ? err.message
      : "Something went wrong. Please try again later.",
  });
};
