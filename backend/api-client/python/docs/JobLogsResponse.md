# JobLogsResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**job_id** | **int** |  | 
**logs** | **str** |  | 

## Example

```python
from openapi_client.models.job_logs_response import JobLogsResponse

# TODO update the JSON string below
json = "{}"
# create an instance of JobLogsResponse from a JSON string
job_logs_response_instance = JobLogsResponse.from_json(json)
# print the JSON string representation of the object
print(JobLogsResponse.to_json())

# convert the object into a dict
job_logs_response_dict = job_logs_response_instance.to_dict()
# create an instance of JobLogsResponse from a dict
job_logs_response_from_dict = JobLogsResponse.from_dict(job_logs_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


