# JobQueueResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**jobs** | [**List[JobRecord]**](JobRecord.md) |  | 

## Example

```python
from openapi_client.models.job_queue_response import JobQueueResponse

# TODO update the JSON string below
json = "{}"
# create an instance of JobQueueResponse from a JSON string
job_queue_response_instance = JobQueueResponse.from_json(json)
# print the JSON string representation of the object
print(JobQueueResponse.to_json())

# convert the object into a dict
job_queue_response_dict = job_queue_response_instance.to_dict()
# create an instance of JobQueueResponse from a dict
job_queue_response_from_dict = JobQueueResponse.from_dict(job_queue_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


