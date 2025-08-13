# LaunchClusterResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**request_id** | **str** |  | 
**cluster_name** | **str** |  | 
**message** | **str** |  | 
**port_forward_info** | **Dict[str, object]** |  | [optional] 

## Example

```python
from openapi_client.models.launch_cluster_response import LaunchClusterResponse

# TODO update the JSON string below
json = "{}"
# create an instance of LaunchClusterResponse from a JSON string
launch_cluster_response_instance = LaunchClusterResponse.from_json(json)
# print the JSON string representation of the object
print(LaunchClusterResponse.to_json())

# convert the object into a dict
launch_cluster_response_dict = launch_cluster_response_instance.to_dict()
# create an instance of LaunchClusterResponse from a dict
launch_cluster_response_from_dict = LaunchClusterResponse.from_dict(launch_cluster_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


