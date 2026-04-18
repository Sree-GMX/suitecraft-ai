from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from app.models.models import QAOrg, OrgRecommendation, TestDataSet
from app.models.schemas import (
    QAOrgCreate, QAOrgResponse, QAOrgUpdate,
    OrgRecommendationRequest, OrgRecommendationResponse,
    OrgRecommendationSchema
)
from app.services.ai_service import ai_service
from app.core.encryption import encryption_service
from datetime import datetime
import json

class OrgService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_org(self, org_data: QAOrgCreate) -> QAOrg:
        org_dict = org_data.model_dump(exclude={'credentials'})
        
        if org_data.credentials:
            encrypted_creds = encryption_service.encrypt(
                json.dumps(org_data.credentials)
            )
            org_dict['credentials_encrypted'] = encrypted_creds
        
        db_org = QAOrg(**org_dict)
        self.db.add(db_org)
        self.db.commit()
        self.db.refresh(db_org)
        return db_org
    
    def get_org(self, org_id: int, decrypt_credentials: bool = False) -> Optional[QAOrg]:
        org = self.db.query(QAOrg).filter(QAOrg.id == org_id).first()
        
        if org and decrypt_credentials and org.credentials_encrypted:
            decrypted = encryption_service.decrypt(org.credentials_encrypted)
            org.credentials = json.loads(decrypted)
        
        return org
    
    def get_orgs(
        self,
        skip: int = 0,
        limit: int = 100,
        active_only: bool = True
    ) -> List[QAOrg]:
        query = self.db.query(QAOrg)
        if active_only:
            query = query.filter(QAOrg.is_active == True)
        return query.offset(skip).limit(limit).all()
    
    def update_org_stability(self, org_id: int, stability_score: float) -> QAOrg:
        org = self.get_org(org_id)
        if org:
            org.stability_score = stability_score
            org.last_validation_date = datetime.utcnow()
            self.db.commit()
            self.db.refresh(org)
        return org

    def update_org(self, org_id: int, org_data: QAOrgUpdate) -> Optional[QAOrg]:
        org = self.get_org(org_id)
        if not org:
            return None

        update_data = org_data.model_dump(exclude_unset=True, exclude={"credentials"})
        for field, value in update_data.items():
            setattr(org, field, value)

        if org_data.credentials is not None:
            org.credentials_encrypted = encryption_service.encrypt(json.dumps(org_data.credentials))

        if org_data.stability_score is not None:
            org.last_validation_date = datetime.utcnow()

        self.db.commit()
        self.db.refresh(org)
        return org

    def delete_org(self, org_id: int) -> bool:
        org = self.get_org(org_id)
        if not org:
            return False

        self.db.query(TestDataSet).filter(TestDataSet.org_id == org_id).delete()
        self.db.query(OrgRecommendation).filter(OrgRecommendation.org_id == org_id).delete()
        self.db.delete(org)
        self.db.commit()
        return True
    
    async def recommend_orgs(
        self,
        request: OrgRecommendationRequest
    ) -> OrgRecommendationResponse:
        from app.services.release_service import ReleaseService
        release_service = ReleaseService(self.db)
        
        release = release_service.get_release(request.release_id)
        if not release:
            raise ValueError(f"Release {request.release_id} not found")
        
        available_orgs = self.get_orgs(active_only=True)
        
        release_requirements = {
            'release_version': release.release_version,
            'required_features': request.required_features or [],
            'data_requirements': request.data_requirements or []
        }
        
        orgs_data = [
            {
                'org_id': org.id,
                'org_name': org.org_name,
                'release_version': org.release_version,
                'enabled_features': org.enabled_features or [],
                'data_sets_available': org.data_sets_available or [],
                'stability_score': org.stability_score
            }
            for org in available_orgs
        ]
        
        ai_recommendations = await ai_service.recommend_org(
            release_requirements,
            orgs_data
        )
        
        recommendations = []
        for ai_rec in ai_recommendations:
            org_rec = OrgRecommendation(
                release_id=request.release_id,
                org_id=ai_rec['org_id'],
                confidence_score=ai_rec['confidence_score'],
                reasoning=ai_rec['reasoning'],
                recommendation_rank=ai_rec['recommendation_rank']
            )
            self.db.add(org_rec)
            
            recommendations.append(OrgRecommendationSchema(
                org_id=ai_rec['org_id'],
                org_name=ai_rec['org_name'],
                confidence_score=ai_rec['confidence_score'],
                reasoning=ai_rec['reasoning'],
                recommendation_rank=ai_rec['recommendation_rank']
            ))
        
        self.db.commit()
        
        recommendations.sort(key=lambda x: x.recommendation_rank)
        
        return OrgRecommendationResponse(
            release_id=request.release_id,
            recommendations=recommendations,
            analysis_timestamp=datetime.utcnow()
        )
    
    def add_test_data_set(
        self,
        org_id: int,
        data_set_name: str,
        data_type: str,
        data_inventory: Dict[str, Any]
    ) -> TestDataSet:
        db_data_set = TestDataSet(
            org_id=org_id,
            data_set_name=data_set_name,
            data_type=data_type,
            data_inventory=data_inventory,
            last_validated=datetime.utcnow()
        )
        self.db.add(db_data_set)
        self.db.commit()
        self.db.refresh(db_data_set)
        return db_data_set
    
    def get_test_data_sets(self, org_id: int) -> List[TestDataSet]:
        return self.db.query(TestDataSet).filter(
            TestDataSet.org_id == org_id,
            TestDataSet.is_available == True
        ).all()
