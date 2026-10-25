FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates && python3 -m venv /opt/yt-dlp && /opt/yt-dlp/bin/pip install --no-cache-dir "yt-dlp[default]" && ln -s /opt/yt-dlp/bin/yt-dlp /usr/local/bin/yt-dlp && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production FFMPEG_PATH=/usr/bin/ffmpeg YTDLP_PATH=/usr/local/bin/yt-dlp PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
