# 🖥️ Hostinger VPS Memory Management & RAM Optimization Guide

This guide provides step-by-step commands to inspect, diagnose, and free up RAM on your Hostinger Ubuntu 24.04 VPS (`46.202.167.245`).

---

## 📑 Table of Contents
1. [SSH into your VPS](#1-connect-to-your-hostinger-vps)
2. [Diagnose: Which Process or Container is Consuming RAM?](#2-diagnose-which-process-is-using-ram)
3. [Understand Linux "Buffer/Cache" vs Real RAM Usage](#3-understanding-buffer-cache-vs-real-ram)
4. [Immediate RAM Cleanup Commands](#4-immediate-ram-cleanup-commands)
5. [Docker Deep Cleanup (Reclaim Docker RAM & Disk)](#5-docker-cleanup-commands)
6. [Prevent Out-Of-Memory (OOM) Crashes: Add Swap Memory](#6-prevent-crashes-add-4gb-swap-file)
7. [Automated Daily RAM Cleanup Script (Cron Job)](#7-set-up-automatic-daily-ram-cleanup)

---

## 1. Connect to Your Hostinger VPS

Open your local terminal (PowerShell, Command Prompt, or Terminal) and run:

```bash
ssh root@46.202.167.245
```
*(Enter your root password when prompted)*

---

## 2. Diagnose: Which Process is Using RAM?

Run these commands to see exactly what is consuming your 73% RAM:

### Command 2.1: Overview of System RAM
```bash
free -h
```
**Explanation**:
- Shows Total, Used, Free, Shared, **Buff/Cache**, and **Available** memory.
- Look at the **Available** column. In Linux, memory in `buff/cache` is automatically released when apps need it.

---

### Command 2.2: Docker Containers Live RAM Usage
Since Coolify runs everything in Docker (Postgres, Redis, Node.js Backend), run:

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}"
```
**Explanation**:
- Lists every running container (e.g., PostgreSQL, Redis, Backend, Traefik).
- Shows exact Megabytes used (`MemUsage`) and percentage (`MemPerc`).
- Tells you immediately which container (Postgres, Redis, or Node.js) is consuming memory.

---

### Command 2.3: Top 15 Memory-Hungry Processes (Linux OS level)
```bash
ps aux --sort=-%mem | awk 'NR<=16{printf "%-8s %-6s %-6s %-6s %s\n", $1, $2, $3, $4, $11}'
```
**Explanation**:
- Displays the top 15 processes sorted by RAM usage percentage.
- `$2` is the Process ID (PID), `$4` is `%MEM`, and the last column is the command name.

---

### Command 2.4: Interactive Visual Monitor (HTOP)
```bash
htop
```
*(If not installed, install it: `apt install -y htop`)*
- Press **F6** (or click SortBy) and select **PERCENT_MEM** to sort processes by highest RAM.
- Press **q** to exit.

---

## 3. Understanding Buffer / Cache vs Real RAM

In Ubuntu Linux, unallocated RAM is deliberately borrowed by the Linux Kernel to cache disk files (`buff/cache`) so your database and disk queries run at lightning speed.
- Hostinger's dashboard calculates `Used + Buff/Cache` as total consumption.
- If your `available` memory in `free -h` is healthy, your server is NOT running out of memory.
- However, if `available` is below 300 MB, you should free it up using the commands below.

---

## 4. Immediate RAM Cleanup Commands

Run these commands safely to immediately reclaim memory without restarting your server:

### Command 4.1: Drop Linux Kernel Disk PageCache & Dentries
```bash
sync && echo 3 > /proc/sys/vm/drop_caches
```
**Explanation**:
- `sync` flushes all pending dirty writes to disk.
- `echo 3 > /proc/sys/vm/drop_caches` forces the Linux kernel to release all cached RAM back to the free pool.
- **Immediate result**: Usually frees up 500 MB to 2 GB of RAM instantly.

---

### Command 4.2: Clear Linux Swap Memory
```bash
swapoff -a && swapon -a
```
**Explanation**:
- Flushes old/stale memory pages stored in swap back to RAM and reinitializes swap cleanly.

---

## 5. Docker Cleanup Commands

Docker accumulates stopped containers, old container layers, and multi-gigabyte log files that consume RAM and disk.

### Command 5.1: Truncate Giant Container Log Files
Containers running for weeks create massive JSON log files that sit in system memory buffers.

```bash
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```
**Explanation**:
- Instantly zeroes out all Docker container stdout/stderr log files without stopping or restarting any containers.

---

### Command 5.2: Prune Unused Docker Objects
```bash
docker system prune -af --volumes
```
**Explanation**:
- Removes stopped containers, unused networks, dangling images, and build caches.
- **Safe**: It will NOT delete active, running containers or named volumes holding database data.

---

### Command 5.3: Restart a Memory-Leaking Container
If `docker stats` shows a specific container (e.g. Node.js backend) has grown too large due to long runtimes:

```bash
# Check container names:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

# Restart the specific container:
docker restart <CONTAINER_NAME>
```
**Explanation**:
- Restarts only that container in 2 seconds; immediately drops its RAM to the starting baseline (~80 MB).

---

## 6. Prevent Crashes: Add 4GB Swap File

On a Hostinger KVM 1 VPS (usually 4GB RAM), if sudden traffic or heavy cron jobs spike RAM to 100%, Linux will trigger the **OOM Killer (Out Of Memory Killer)** which forcefully kills PostgreSQL or Node.js.

Creating a **4GB Swap File** provides an emergency safety cushion so your server **never crashes**.

### Step-by-Step Commands to Add 4GB Swap:

```bash
# 1. Verify if swap already exists:
swapon --show

# 2. Allocate a 4GB file:
fallocate -l 4G /swapfile

# 3. Set secure permissions (only root can read):
chmod 600 /swapfile

# 4. Format file as swap:
mkswap /swapfile

# 5. Enable the swap:
swapon /swapfile

# 6. Make it permanent across reboots:
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 7. Optimize swappiness (tell Linux to only use swap when RAM is > 85% full):
sysctl vm.swappiness=15
echo 'vm.swappiness=15' >> /etc/sysctl.conf
```

Verify the swap is active:
```bash
free -h
```
You will now see `Swap: 4.0Gi` ready.

---

## 7. Set Up Automatic Daily RAM Cleanup

To keep your Hostinger VPS permanently clean without manual intervention, add an automated cron job that flushes caches every night at 03:00 AM:

```bash
# Open root crontab:
crontab -e
```

Add this line at the bottom of the file:
```cron
0 3 * * * sync && echo 3 > /proc/sys/vm/drop_caches && truncate -s 0 /var/lib/docker/containers/*/*-json.log
```
- Saves and runs automatically at 3:00 AM server time.
- Keeps RAM lean, log files truncated, and performance fast.

---

## 📋 Quick Cheat Sheet (Copy-Paste All-in-One Command)

To check and clean your VPS in 5 seconds, SSH into your server and run this single one-liner:

```bash
echo "=== RAM BEFORE ===" && free -h && sync && echo 3 > /proc/sys/vm/drop_caches && truncate -s 0 /var/lib/docker/containers/*/*-json.log && docker stats --no-stream && echo "=== RAM AFTER ===" && free -h
```
