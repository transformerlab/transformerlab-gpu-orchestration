import sky

import asyncio


async def fetch_and_parse_gpu_resources(cluster_name: str):
    async def run_cmd(cmd, capture_output=True):
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE if capture_output else None,
                stderr=asyncio.subprocess.PIPE if capture_output else None,
            )
            print(f"PROCESS: {process}")
            stdout, stderr = await process.communicate()
            return (
                process.returncode,
                stdout.decode() if stdout else "",
                stderr.decode() if stderr else "",
            )
        except Exception as e:
            print(f"Error running command: {e}")
            return None, None, str(e)

    # code, out, err = await run_cmd(["sky", "ssh", "up", "--infra", cluster_name])
    request_id = sky.client.sdk.ssh_up(infra=cluster_name)
    try:
        result = sky.get(request_id)
    except Exception as e:
        print(f"Error bringing up SSH cluster: {e}")
        raise Exception(f"Failed to bring up SSH cluster: {e}")
    # if code != 0:
    #     raise Exception(f"Failed to bring up SSH cluster: {err or out}")
    # 3. sky show-gpus --infra ssh
    code, out, err = await run_cmd(["sky", "show-gpus", "--infra", "ssh"])
    # 4. sky ssh down (cleanup)
    # await run_cmd(["sky", "ssh", "down", "--infra", cluster_name], capture_output=False)

    def parse_gpu_output(output, cluster_name):
        import re

        lines = output.splitlines()
        gpus = []
        node_gpus = []
        pool_section = False
        per_node_section = False

        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line.startswith(f"SSH Node Pool: {cluster_name}"):
                pool_section = True
                per_node_section = False
                continue
            if line.startswith("SSH Node Pool per-node GPU availability"):
                pool_section = False
                per_node_section = True
                continue
            if pool_section:
                if line.startswith("GPU"):
                    continue  # skip header
                parts = re.split(r"\s{2,}", line)
                if len(parts) >= 3:
                    gpus.append(
                        {
                            "gpu": parts[0],
                            "requestable_qty_per_node": parts[1],
                            "utilization": parts[2],
                        }
                    )
            elif per_node_section:
                if line.startswith("NODE_POOL"):
                    continue  # skip per-node header
                parts = re.split(r"\s{2,}", line)
                if len(parts) >= 4:
                    node_gpus.append(
                        {
                            "node_pool": parts[0],
                            "node": parts[1],
                            "gpu": parts[2],
                            "utilization": parts[3],
                        }
                    )
        if gpus or node_gpus:
            return {"gpus": gpus, "node_gpus": node_gpus}
        if "No GPUs found in any SSH clusters" in output:
            return {
                "gpus": [],
                "node_gpus": [],
                "message": "No GPUs found in this SSH cluster.",
            }
        return {
            "gpus": [],
            "node_gpus": [],
            "message": "No GPU info found for this cluster.",
        }

    return parse_gpu_output(out, cluster_name)


def generate_cost_report():
    request_id = sky.client.sdk.cost_report()
    cost_report = sky.get(request_id)
    # print(f"[SkyPilot] Cost report: {cost_report}")
    return cost_report
