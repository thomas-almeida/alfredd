FROM node:22-bookworm-slim
ARG BGUTIL_VERSION=2.0.2
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates curl unzip git \
  && python3 -m venv /opt/yt-dlp \
  && /opt/yt-dlp/bin/pip install --no-cache-dir "yt-dlp[default]" bgutil-ytdlp-pot-provider \
  && git clone --depth 1 --branch ${BGUTIL_VERSION} https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider \
  && cd /opt/bgutil-ytdlp-pot-provider/server \
  && npm ci \
  && npx tsc \
  && curl -fsSL https://deno.land/install.sh | sh \
  && ln -s /root/.deno/bin/deno /usr/local/bin/deno \
  && ln -s /opt/yt-dlp/bin/yt-dlp /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY start.sh ./start.sh
RUN chmod +x ./start.sh
ENV NODE_ENV=production FFMPEG_PATH=/usr/bin/ffmpeg YTDLP_PATH=/usr/local/bin/yt-dlp YOUTUBE_POT_PROVIDER_URL=http://127.0.0.1:4416 PORT=8080
EXPOSE 8080
CMD ["./start.sh"]
