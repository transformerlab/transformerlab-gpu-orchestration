# UpdateSSHKeyRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | [optional] 
**is_active** | **bool** |  | [optional] 

## Example

```python
from openapi_client.models.update_ssh_key_request import UpdateSSHKeyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateSSHKeyRequest from a JSON string
update_ssh_key_request_instance = UpdateSSHKeyRequest.from_json(json)
# print the JSON string representation of the object
print(UpdateSSHKeyRequest.to_json())

# convert the object into a dict
update_ssh_key_request_dict = update_ssh_key_request_instance.to_dict()
# create an instance of UpdateSSHKeyRequest from a dict
update_ssh_key_request_from_dict = UpdateSSHKeyRequest.from_dict(update_ssh_key_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


