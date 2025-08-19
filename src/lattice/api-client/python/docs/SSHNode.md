# SSHNode


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ip** | **str** |  | 
**user** | **str** |  | 
**identity_file** | **str** |  | [optional] 
**password** | **str** |  | [optional] 
**resources** | **Dict[str, object]** |  | [optional] 

## Example

```python
from openapi_client.models.ssh_node import SSHNode

# TODO update the JSON string below
json = "{}"
# create an instance of SSHNode from a JSON string
ssh_node_instance = SSHNode.from_json(json)
# print the JSON string representation of the object
print(SSHNode.to_json())

# convert the object into a dict
ssh_node_dict = ssh_node_instance.to_dict()
# create an instance of SSHNode from a dict
ssh_node_from_dict = SSHNode.from_dict(ssh_node_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


