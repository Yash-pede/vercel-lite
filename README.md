# ⚡ Vercel-Lite

A lightweight open-source Vercel clone built with Node.js, Next.js, Docker, AWS S3, and NGINX. `vercel-lite` replicates the core functionality of Vercel: allowing users to deploy frontend projects (like static sites) by providing a GitHub repo URL, which gets built and served with custom subdomains via a reverse proxy.

---

## 📦 Folder Structure

```
vercel-lite/
│
├── api-service/           # Express API to accept deployments & expose status
│   ├── main.js
│   ├── .env
│   └── package.json
│
├── build-server/          # Dockerized server to clone, build & upload projects
│   ├── script.js
│   ├── main.sh
│   ├── Dockerfile
│   └── package.json
│
├── frontend/              # User interface built with Next.js and TailwindCSS
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── public/
│
├── reverse-proxy-nginx/   # NGINX reverse proxy to map subdomains to S3
│   ├── nginx.conf
│   └── Dockerfile
│
├── infra-aws/             # Terraform code for S3 and IAM provisioning
│   ├── main.tf
│   └──terraform.tf
│         # Root environment config
└── .gitignore
```

---

## 🛠️ Tech Stack

* **Frontend**: Next.js + TailwindCSS
* **Backend API**: Node.js + Express
* **Build System**: Docker, Node.js
* **Storage**: AWS S3
* **Infra**: Terraform (AWS)
* **Proxy**: NGINX (custom reverse proxy for domain routing)

---

## 🚀 Features

* Deploy any static frontend project by GitHub repo URL.
* Auto clone → install → build → upload to S3.
* Access deployments on custom subdomains via NGINX.
* Full real-time status updates on deployment.
* Terraform-based infra provisioning (S3 buckets, IAM).
* Dockerized services for isolation and scaling.

---

## ⚙️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/Yash-pede/vercel-lite.git
cd vercel-lite
```

### 2. Setup environment files

Create a `.env` file in the root and inside `api-service/` and `build-server/`:

```env
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=your-region
S3_BUCKET_NAME=your-bucket
```

### 3. Start API Server

```bash
cd api-service
npm install
node main.js
```

### 4. Build & Push Build Server to AWS ECR

Ensure your AWS ECR repo is created using Terraform in `infra-aws`. Then:

```bash
cd build-server
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <your-account-id>.dkr.ecr.<your-region>.amazonaws.com

docker build -t build-server .

docker tag build-server:latest <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/build-server:latest

docker push <your-account-id>.dkr.ecr.<your-region>.amazonaws.com/build-server:latest
```

### 5. Start Frontend

```bash
cd frontend
bun install # or npm install
bun dev     # or npm run dev
```

### 6. Setup NGINX Reverse Proxy

```bash
cd reverse-proxy-nginx
docker build -t reverse-proxy .
docker run -p 80:80 reverse-proxy
```

> Configure `nginx.conf` to map subdomains to S3 URLs.

---

## ☁️ Terraform Setup (AWS Infra)

```bash
cd infra-aws
terraform init
terraform apply
```

This will create:

* S3 bucket
* IAM policies for upload access
* ECR, ECS, ALB

---


## 🧩 To-Do / Improvements

* [ ] Custom domain support via DNS
* [ ] GitHub OAuth Integration

---

## 🤝 Contributing

PRs are welcome! Please open issues or suggestions to improve.

---

## 📄 License

MIT License © 2025 [Yash Pede](https://github.com/yashpede)
