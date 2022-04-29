"""
Fabric deployment script for EHRI front-end webapp.
"""

import os
from datetime import datetime

from fabric import task
from invoke import run as local

deploys_dir = "/opt/emt/deploys"
target_link = "/opt/emt/target"


@task
def deploy(ctx, clean=False):
    """Build (optionally with clean) and deploy the distribution"""
    version = get_version_stamp(ctx)
    build_cmd = "sbt dist" if not clean else "sbt clean dist"
    local(build_cmd)
    file = local("ls -1t target/universal/emt-*.zip").stdout.strip()
    base = os.path.basename(file)
    if not file or file == "":
        raise Exception("Cannot find latest build zip in target/universal!")
    version_dir = f"{deploys_dir}/{version}"

    ctx.put(file, remote="/tmp")
    ctx.run(f"mkdir -p {version_dir}")
    ctx.run(f"unzip /tmp/{base} -d {version_dir}")
    symlink_target(ctx, version_dir, target_link)
    restart(ctx)


@task
def rollback(ctx):
    """Set the current version to the previous version directory"""
    output = ctx.run(f"ls -1rt {deploys_dir} | tail -n 2 | head -n 1").stdout.strip()
    if output == "":
        raise Exception("Unable to get previous version for rollback!")
    symlink_target(ctx, f"{deploys_dir}/{output}", target_link)
    restart(ctx)


@task
def latest(ctx):
    """Set the current version to the latest version directory"""
    output = ctx.run(f"ls -1rt {deploys_dir} | tail -n 1").stdout.strip()
    if output == "":
        raise Exception("Unable to get previous version for rollback!")
    symlink_target(ctx, f"{deploys_dir}/{output}", target_link)
    restart(ctx)


@task
def symlink_target(ctx, version_dir, target):
    """Symlink a version directory"""
    ctx.run(f"ln --force --no-dereference --symbolic {version_dir} {target}")
    ctx.run(f"chgrp -R webadm {target_link}")


@task
def restart(ctx):
    """Restart the emt process"""
    ctx.run("sudo service emt restart")


@task
def get_version_stamp(ctx):
    """Get the tag for a version, consisting of the current time and git revision"""
    res = local("git rev-parse --short HEAD").stdout.strip()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{timestamp}_{res}"
