# infrapilot_server

Manages a server instance through the Infra Pilot platform.

## Example Usage

```hcl
resource "infrapilot_server" "minecraft" {
  name   = "my-minecraft-server"
  type   = "minecraft"
  memory = 2048
  disk   = 4096
  cpu    = 200
}

resource "infrapilot_server" "node_app" {
  name   = "my-node-app"
  type   = "nodejs"
  memory = 512
}
```

## Argument Reference

- `name` - (Required) The display name of the server.
- `type` - (Required) The server type. Must be one of: `minecraft`, `nodejs`,
  `python`, `database`, `teamspeak`.
- `memory` - (Optional) Memory allocation in MB. Defaults to `1024`.
- `disk` - (Optional) Disk space allocation in MB. Defaults to `1024`.
- `cpu` - (Optional) CPU limit percentage. Defaults to `100`.

## Attributes Reference

- `identifier` - The unique server identifier assigned by the API.
- `status` - The current status of the server (creating, active, stopping, etc.).
- `node_id` - The node ID where the server is deployed.

## Import

Servers can be imported using the server identifier:

```shell
terraform import infrapilot_server.minecraft mc-abc123
```
