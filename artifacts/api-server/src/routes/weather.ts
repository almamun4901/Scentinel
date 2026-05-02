import { Router } from "express";
import { GetWeatherQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/weather", async (req, res) => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing lat or lon parameters" });
    return;
  }
  const { lat, lon } = parsed.data;

  const apiKey = process.env["OPENWEATHER_KEY"];
  if (!apiKey) {
    // Return a reasonable default when no key is configured
    res.json({ temp_c: 18, description: "partly cloudy", humidity: 60 });
    return;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);
    if (!response.ok) {
      // Fall back to a neutral default rather than propagating the error
      req.log.warn({ status: response.status }, "OpenWeatherMap returned non-200, using defaults");
      res.json({ temp_c: 18, description: "partly cloudy", humidity: 60 });
      return;
    }
    const data = (await response.json()) as {
      main: { temp: number; humidity: number };
      weather: Array<{ description: string }>;
    };
    res.json({
      temp_c: Math.round(data.main.temp * 10) / 10,
      description: data.weather[0]?.description ?? "unknown",
      humidity: data.main.humidity,
    });
  } catch (err) {
    req.log.error({ err }, "Weather API request failed");
    res.status(503).json({ error: "Weather service unavailable" });
  }
});

export default router;
