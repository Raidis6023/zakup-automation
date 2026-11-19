FROM node:24-bookworm-slim
WORKDIR /opt/panda-scheduler
COPY infra/scheduler/jobs.json ./
COPY infra/scheduler/schedule.mjs ./
COPY infra/scheduler/runner.mjs ./
RUN mkdir /state && chown node:node /state
USER node
CMD ["node", "runner.mjs"]
