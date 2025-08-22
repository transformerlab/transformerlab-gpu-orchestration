# SSHKeyListResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ssh_keys** | [**List[SSHKeyResponse]**](SSHKeyResponse.md) |  | 
**total_count** | **int** |  | 

## Example

```python
from openapi_client.models.ssh_key_list_response import SSHKeyListResponse

# TODO update the JSON string below
json = "{}"
# create an instance of SSHKeyListResponse from a JSON string
ssh_key_list_response_instance = SSHKeyListResponse.from_json(json)
# print the JSON string representation of the object
print(SSHKeyListResponse.to_json())

# convert the object into a dict
ssh_key_list_response_dict = ssh_key_list_response_instance.to_dict()
# create an instance of SSHKeyListResponse from a dict
ssh_key_list_response_from_dict = SSHKeyListResponse.from_dict(ssh_key_list_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


