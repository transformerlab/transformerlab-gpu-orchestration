# GPUUsageLogResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**organization_id** | **str** |  | 
**user_id** | **str** |  | 
**user_email** | **str** |  | [optional] 
**user_name** | **str** |  | [optional] 
**cluster_name** | **str** |  | 
**job_id** | **int** |  | [optional] 
**gpu_count** | **int** |  | 
**start_time** | **str** |  | 
**end_time** | **str** |  | [optional] 
**duration_hours** | **float** |  | [optional] 
**instance_type** | **str** |  | [optional] 
**cloud_provider** | **str** |  | [optional] 
**cost_estimate** | **float** |  | [optional] 

## Example

```python
from openapi_client.models.gpu_usage_log_response import GPUUsageLogResponse

# TODO update the JSON string below
json = "{}"
# create an instance of GPUUsageLogResponse from a JSON string
gpu_usage_log_response_instance = GPUUsageLogResponse.from_json(json)
# print the JSON string representation of the object
print(GPUUsageLogResponse.to_json())

# convert the object into a dict
gpu_usage_log_response_dict = gpu_usage_log_response_instance.to_dict()
# create an instance of GPUUsageLogResponse from a dict
gpu_usage_log_response_from_dict = GPUUsageLogResponse.from_dict(gpu_usage_log_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


