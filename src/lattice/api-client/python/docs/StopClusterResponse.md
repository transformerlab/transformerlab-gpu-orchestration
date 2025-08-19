# StopClusterResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**request_id** | **str** |  | 
**cluster_name** | **str** |  | 
**message** | **str** |  | 

## Example

```python
from openapi_client.models.stop_cluster_response import StopClusterResponse

# TODO update the JSON string below
json = "{}"
# create an instance of StopClusterResponse from a JSON string
stop_cluster_response_instance = StopClusterResponse.from_json(json)
# print the JSON string representation of the object
print(StopClusterResponse.to_json())

# convert the object into a dict
stop_cluster_response_dict = stop_cluster_response_instance.to_dict()
# create an instance of StopClusterResponse from a dict
stop_cluster_response_from_dict = StopClusterResponse.from_dict(stop_cluster_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


