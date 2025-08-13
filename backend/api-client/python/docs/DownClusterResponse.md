# DownClusterResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**request_id** | **str** |  | 
**cluster_name** | **str** |  | 
**message** | **str** |  | 

## Example

```python
from openapi_client.models.down_cluster_response import DownClusterResponse

# TODO update the JSON string below
json = "{}"
# create an instance of DownClusterResponse from a JSON string
down_cluster_response_instance = DownClusterResponse.from_json(json)
# print the JSON string representation of the object
print(DownClusterResponse.to_json())

# convert the object into a dict
down_cluster_response_dict = down_cluster_response_instance.to_dict()
# create an instance of DownClusterResponse from a dict
down_cluster_response_from_dict = DownClusterResponse.from_dict(down_cluster_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


