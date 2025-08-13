# JobRecord


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**job_id** | **int** |  | 
**job_name** | **str** |  | 
**username** | **str** |  | 
**submitted_at** | **float** |  | 
**start_at** | **float** |  | [optional] 
**end_at** | **float** |  | [optional] 
**resources** | **str** |  | 
**status** | **str** |  | 
**log_path** | **str** |  | 

## Example

```python
from openapi_client.models.job_record import JobRecord

# TODO update the JSON string below
json = "{}"
# create an instance of JobRecord from a JSON string
job_record_instance = JobRecord.from_json(json)
# print the JSON string representation of the object
print(JobRecord.to_json())

# convert the object into a dict
job_record_dict = job_record_instance.to_dict()
# create an instance of JobRecord from a dict
job_record_from_dict = JobRecord.from_dict(job_record_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


