"""Policy regression checks without downloading or loading model weights."""
import unittest
from service import Service

class FakeModel:
    def __init__(self, truncated=False): self.calls=0; self.truncated=truncated
    def route(self,text,product):
        self.calls+=1
        return {'route':'product_search','attributes':[], 'truncated':self.truncated}

class PolicyTests(unittest.TestCase):
    def test_missing_target_cannot_skip_clarification(self):
        result=Service(FakeModel()).decide({'text':'A desk lamp appears in a travel video.'})
        self.assertEqual(result['route'],'clarify')
        self.assertEqual(result['attributes'],[])

    def test_truncation_abstains(self):
        result=Service(FakeModel(True)).decide({'text':'evidence','target':{'name':'lamp'}})
        self.assertEqual(result['route'],'clarify')

    def test_cache_preserves_per_request_provenance_and_target(self):
        model=FakeModel(); service=Service(model)
        first=service.decide({'text':'evidence','target':{'name':'lamp'},'requestId':'a','sourceKind':'ocr'})
        second=service.decide({'text':'evidence','target':{'name':'lamp'},'requestId':'b','sourceKind':'transcript'})
        third=service.decide({'text':'evidence','target':{'name':'chair'}})
        self.assertEqual(model.calls,2)
        self.assertFalse(first['cache_hit']); self.assertTrue(second['cache_hit']); self.assertFalse(third['cache_hit'])
        self.assertEqual(second['requestId'],'b'); self.assertEqual(second['sourceKind'],'transcript')
        self.assertEqual(first['requestId'],'a')

    def test_raw_media_rejected(self):
        with self.assertRaises(ValueError):
            Service(FakeModel()).decide({'text':'evidence','target':{'name':'lamp'},'sourceKind':'video'})

if __name__=='__main__': unittest.main()
