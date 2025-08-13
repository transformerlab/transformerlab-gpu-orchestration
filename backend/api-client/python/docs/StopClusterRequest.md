# StopClusterRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**cluster_name** | **str** |  | 

## Example

```python
from openapi_client.models.stop_cluster_request import StopClusterRequest

# TODO update the JSON string below
json = "{}"
# create an instance of StopClusterRequest from a JSON string
stop_cluster_request_instance = StopClusterRequest.from_json(json)
# print the JSON string representation of the object
print(StopClusterRequest.to_json())

# convert the object into a dict
stop_cluster_request_dict = stop_cluster_request_instance.to_dict()
# create an instance of StopClusterRequest from a dict
stop_cluster_request_from_dict = StopClusterRequest.from_dict(stop_cluster_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


