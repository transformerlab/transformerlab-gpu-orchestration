# CreateSSHKeyRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**public_key** | **str** |  | 

## Example

```python
from openapi_client.models.create_ssh_key_request import CreateSSHKeyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CreateSSHKeyRequest from a JSON string
create_ssh_key_request_instance = CreateSSHKeyRequest.from_json(json)
# print the JSON string representation of the object
print(CreateSSHKeyRequest.to_json())

# convert the object into a dict
create_ssh_key_request_dict = create_ssh_key_request_instance.to_dict()
# create an instance of CreateSSHKeyRequest from a dict
create_ssh_key_request_from_dict = CreateSSHKeyRequest.from_dict(create_ssh_key_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


