# ClusterStatusResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**cluster_name** | **str** |  | 
**status** | **str** |  | 
**launched_at** | **int** |  | [optional] 
**last_use** | **str** |  | [optional] 
**autostop** | **int** |  | [optional] 
**to_down** | **bool** |  | [optional] 
**resources_str** | **str** |  | [optional] 
**user_info** | **Dict[str, object]** |  | [optional] 

## Example

```python
from openapi_client.models.cluster_status_response import ClusterStatusResponse

# TODO update the JSON string below
json = "{}"
# create an instance of ClusterStatusResponse from a JSON string
cluster_status_response_instance = ClusterStatusResponse.from_json(json)
# print the JSON string representation of the object
print(ClusterStatusResponse.to_json())

# convert the object into a dict
cluster_status_response_dict = cluster_status_response_instance.to_dict()
# create an instance of ClusterStatusResponse from a dict
cluster_status_response_from_dict = ClusterStatusResponse.from_dict(cluster_status_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


